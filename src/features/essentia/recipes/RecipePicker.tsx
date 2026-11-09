'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GTNH_DATASET_BASE_URL, GTNH_VERSION } from '@/config/gtnh'
import {
  type InfusionRecipe,
  infusionIconUrl,
  loadInfusionRecipes,
} from '@/features/essentia/recipes/infusionRecipes'
import { AspectTag } from '@/features/essentia/shared/AspectVisuals'

function RecipeIcon({ recipe }: { recipe: InfusionRecipe }) {
  const [failed, setFailed] = useState(false)
  const url = infusionIconUrl(recipe)
  return (
    <span className="ess-recipe-icon" aria-hidden="true">
      {url && !failed ? (
        <Image
          src={url}
          width={36}
          height={36}
          unoptimized
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{recipe.name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  )
}

export function RecipePicker({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (recipe: InfusionRecipe) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(30)
  const {
    data: recipes,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['infusion-recipes', GTNH_VERSION, GTNH_DATASET_BASE_URL],
    queryFn: ({ signal }) => loadInfusionRecipes(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnReconnect: false,
  })
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return recipes ?? []
    return (recipes ?? []).filter((recipe) =>
      `${recipe.name} ${recipe.itemId} ${recipe.research ?? ''}`
        .toLocaleLowerCase()
        .includes(normalized),
    )
  }, [recipes, query])

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    searchRef.current?.focus()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      className="ess-recipe-dialog"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="ess-recipe-heading">
        <h2>Infusion recipes</h2>
        <button type="button" onClick={onClose} aria-label="Close recipes">
          ×
        </button>
      </div>
      <label className="ess-recipe-search">
        <span className="sr-only">Search infusion recipes</span>
        <input
          ref={searchRef}
          type="search"
          placeholder="Search recipes"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setVisibleCount(30)
          }}
        />
      </label>
      <div className="ess-recipe-count" role="status">
        {isPending ? 'Loading…' : isError ? 'Could not load recipes' : `${matches.length} recipes`}
      </div>
      {isError && (
        <button className="ess-recipe-retry" type="button" onClick={() => void refetch()}>
          Retry
        </button>
      )}
      {!isPending && !isError && (
        <div className="ess-recipe-results">
          {matches.length === 0 && <p className="ess-recipe-empty">No recipes found</p>}
          {matches.slice(0, visibleCount).map((recipe) => (
            <button
              className="ess-recipe-result"
              type="button"
              key={recipe.id}
              onClick={() => {
                onSelect(recipe)
                onClose()
              }}
            >
              <RecipeIcon recipe={recipe} />
              <span className="ess-recipe-result-body">
                <strong>{recipe.name}</strong>
                <span className="ess-recipe-aspects">
                  {Object.entries(recipe.aspects).map(([aspect, amount]) => (
                    <AspectTag key={aspect} name={aspect} amount={amount} />
                  ))}
                </span>
              </span>
            </button>
          ))}
          {visibleCount < matches.length && (
            <button
              type="button"
              className="ess-recipe-more"
              onClick={() => setVisibleCount((count) => count + 30)}
            >
              Show 30 more
            </button>
          )}
        </div>
      )}
    </dialog>
  )
}
