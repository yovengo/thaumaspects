import { canvasFor, clamp } from './imageProcessing'

type QuantizedTensor = { shape: number[]; scale: number; data: string }
type ConvLayer = { weight: QuantizedTensor; bias: number[]; stride: number; padding: number }
type DenseLayer = { weight: QuantizedTensor; bias: number[] }

type SerializedCellModel = {
  format: number
  inputSize: number
  labels: string[]
  aliases: Record<string, string[]>
  metrics: { syntheticAspectAccuracy: number; syntheticPresenceAccuracy: number }
  layers: {
    conv1: ConvLayer
    conv2: ConvLayer
    hidden: DenseLayer
    aspect: DenseLayer
    presence: DenseLayer
  }
}

type Tensor = { shape: number[]; values: Float32Array }
type LoadedConvLayer = Omit<ConvLayer, 'weight'> & { weight: Tensor }
type LoadedDenseLayer = Omit<DenseLayer, 'weight'> & { weight: Tensor }

export type CellModel = {
  inputSize: number
  labels: string[]
  aliases: Record<string, string[]>
  metrics: SerializedCellModel['metrics']
  layers: {
    conv1: LoadedConvLayer
    conv2: LoadedConvLayer
    hidden: LoadedDenseLayer
    aspect: LoadedDenseLayer
    presence: LoadedDenseLayer
  }
}

export type CellPrediction = {
  aspect: string
  aspectConfidence: number
  aspectMargin: number
  presenceConfidence: number
  matchX: number
  matchY: number
}

let modelPromise: Promise<CellModel> | null = null

function decodeTensor(tensor: QuantizedTensor): Tensor {
  const binary = atob(tensor.data)
  const signed = new Int8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) signed[index] = binary.charCodeAt(index)
  const values = new Float32Array(signed.length)
  for (let index = 0; index < values.length; index += 1) values[index] = signed[index] * tensor.scale
  return { shape: tensor.shape, values }
}

export function loadCellModel() {
  if (!modelPromise) {
    modelPromise = fetch('/models/research-cell-model.json')
      .then((response) => {
        if (!response.ok) throw new Error('The local research recognition model could not be loaded.')
        return response.json() as Promise<SerializedCellModel>
      })
      .then((serialized) => ({
        inputSize: serialized.inputSize,
        labels: serialized.labels,
        aliases: serialized.aliases,
        metrics: serialized.metrics,
        layers: {
          conv1: { ...serialized.layers.conv1, weight: decodeTensor(serialized.layers.conv1.weight) },
          conv2: { ...serialized.layers.conv2, weight: decodeTensor(serialized.layers.conv2.weight) },
          hidden: { ...serialized.layers.hidden, weight: decodeTensor(serialized.layers.hidden.weight) },
          aspect: { ...serialized.layers.aspect, weight: decodeTensor(serialized.layers.aspect.weight) },
          presence: { ...serialized.layers.presence, weight: decodeTensor(serialized.layers.presence.weight) },
        },
      }))
  }
  return modelPromise
}

function sampleCell(source: HTMLCanvasElement, centerX: number, centerY: number, size: number, inputSize: number) {
  const { context } = canvasFor(inputSize, inputSize)
  context.imageSmoothingEnabled = true
  context.drawImage(source, centerX - size / 2, centerY - size / 2, size, size, 0, 0, inputSize, inputSize)
  const pixels = context.getImageData(0, 0, inputSize, inputSize).data
  const border: [number[], number[], number[]] = [[], [], []]
  for (let y = 0; y < inputSize; y += 1) {
    for (let x = 0; x < inputSize; x += 1) {
      if (x >= 3 && x < inputSize - 3 && y >= 3 && y < inputSize - 3) continue
      const offset = (y * inputSize + x) * 4
      border[0].push(pixels[offset])
      border[1].push(pixels[offset + 1])
      border[2].push(pixels[offset + 2])
    }
  }
  const median = border.map((channel) => {
    channel.sort((a, b) => a - b)
    return channel[Math.floor(channel.length / 2)]
  })
  const values = new Float32Array(3 * inputSize * inputSize)
  const plane = inputSize * inputSize
  for (let index = 0; index < plane; index += 1) {
    values[index] = clamp((pixels[index * 4] - median[0]) / 128, -1, 1)
    values[plane + index] = clamp((pixels[index * 4 + 1] - median[1]) / 128, -1, 1)
    values[plane * 2 + index] = clamp((pixels[index * 4 + 2] - median[2]) / 128, -1, 1)
  }
  return { shape: [3, inputSize, inputSize], values }
}

function convolution(input: Tensor, layer: LoadedConvLayer): Tensor {
  const [inputChannels, inputHeight, inputWidth] = input.shape
  const [outputChannels, , kernelHeight, kernelWidth] = layer.weight.shape
  const outputHeight = Math.floor((inputHeight + layer.padding * 2 - kernelHeight) / layer.stride) + 1
  const outputWidth = Math.floor((inputWidth + layer.padding * 2 - kernelWidth) / layer.stride) + 1
  const output = new Float32Array(outputChannels * outputHeight * outputWidth)
  for (let outputChannel = 0; outputChannel < outputChannels; outputChannel += 1) {
    for (let outputY = 0; outputY < outputHeight; outputY += 1) {
      for (let outputX = 0; outputX < outputWidth; outputX += 1) {
        let sum = layer.bias[outputChannel]
        for (let inputChannel = 0; inputChannel < inputChannels; inputChannel += 1) {
          for (let kernelY = 0; kernelY < kernelHeight; kernelY += 1) {
            const inputY = outputY * layer.stride + kernelY - layer.padding
            if (inputY < 0 || inputY >= inputHeight) continue
            for (let kernelX = 0; kernelX < kernelWidth; kernelX += 1) {
              const inputX = outputX * layer.stride + kernelX - layer.padding
              if (inputX < 0 || inputX >= inputWidth) continue
              const inputIndex = inputChannel * inputHeight * inputWidth + inputY * inputWidth + inputX
              const weightIndex = ((outputChannel * inputChannels + inputChannel) * kernelHeight + kernelY) * kernelWidth + kernelX
              sum += input.values[inputIndex] * layer.weight.values[weightIndex]
            }
          }
        }
        output[(outputChannel * outputHeight + outputY) * outputWidth + outputX] = Math.max(0, sum)
      }
    }
  }
  return { shape: [outputChannels, outputHeight, outputWidth], values: output }
}

function dense(input: Float32Array, layer: LoadedDenseLayer, relu = false) {
  const [outputSize, inputSize] = layer.weight.shape
  const output = new Float32Array(outputSize)
  for (let row = 0; row < outputSize; row += 1) {
    let sum = layer.bias[row]
    const rowOffset = row * inputSize
    for (let column = 0; column < inputSize; column += 1) {
      sum += input[column] * layer.weight.values[rowOffset + column]
    }
    output[row] = relu ? Math.max(0, sum) : sum
  }
  return output
}

function softmax(logits: Float32Array) {
  const maximum = Math.max(...logits)
  const probabilities = new Float32Array(logits.length)
  let total = 0
  for (let index = 0; index < logits.length; index += 1) {
    probabilities[index] = Math.exp(logits[index] - maximum)
    total += probabilities[index]
  }
  for (let index = 0; index < probabilities.length; index += 1) probabilities[index] /= total
  return probabilities
}

function infer(model: CellModel, input: Tensor) {
  const first = convolution(input, model.layers.conv1)
  const second = convolution(first, model.layers.conv2)
  const hidden = dense(second.values, model.layers.hidden, true)
  return {
    aspects: softmax(dense(hidden, model.layers.aspect)),
    presence: 1 / (1 + Math.exp(-dense(hidden, model.layers.presence)[0])),
  }
}

export function recognizeCellAt(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  model: CellModel,
  allowedAspects: Set<string>,
): CellPrediction {
  const centered = infer(model, sampleCell(source, x, y, radius * 2.25, model.inputSize))
  const ranked = [...centered.aspects.entries()]
    .map(([index, probability]) => ({
      index,
      probability,
      aspect: index === 0
        ? ''
        : (model.aliases[model.labels[index]] ?? [model.labels[index]]).find((aspect) => allowedAspects.has(aspect)) ?? '',
    }))
    .filter((candidate) => candidate.index === 0 || candidate.aspect)
    .sort((left, right) => right.probability - left.probability)
  const [winner, runnerUp] = ranked
  const best = !winner || winner.index === 0
    ? { aspect: '', aspectConfidence: 0, aspectMargin: 0, matchX: x, matchY: y }
    : {
        aspect: winner.aspect,
        aspectConfidence: winner.probability,
        aspectMargin: winner.probability - (runnerUp?.probability ?? 0),
        matchX: x,
        matchY: y,
      }
  return { ...best, presenceConfidence: centered.presence }
}
