import { Check, Heart } from 'lucide-react';
import { useAppData } from '../AppData.jsx';
import { cx } from '../lib/format.js';
import OutfitBoard from './OutfitBoard.jsx';
import { ScoreBadge } from './ui.jsx';

// Short title like "White shirt + Khaki chinos".
export function outfitTitle(itemIds, itemsById) {
  const items = itemIds.map(id => itemsById.get(id)).filter(Boolean);
  const main = items.filter(i => ['onepiece', 'top', 'bottom'].includes(i.category));
  return main.map(i => i.name).join(' + ');
}

export default function OutfitCard({ outfit, occasion, onOpen, children, showWear = true }) {
  const { itemsById, isFavorite, toggleFavorite, wear } = useAppData();
  const fav = isFavorite(outfit.itemIds);
  const topNote = outfit.notes?.find(n => n.good) || outfit.notes?.[0];

  return (
    <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <div className="p-2">
        <button type="button" onClick={onOpen} disabled={!onOpen} className="block w-full text-left disabled:cursor-default" aria-label="Show this outfit">
          <OutfitBoard itemIds={outfit.itemIds} />
        </button>
      </div>
      <div className="flex flex-1 flex-col border-t border-line px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{outfitTitle(outfit.itemIds, itemsById)}</h3>
          {outfit.score != null && <ScoreBadge score={outfit.score} />}
        </div>
        {topNote && <p className={cx('mt-1 line-clamp-1 text-xs', topNote.good ? 'text-muted' : 'text-warn')}>{topNote.text}</p>}
        <div className="mt-auto flex items-center gap-2 pt-3">
          {showWear && (
            <button className="btn btn-secondary h-8 min-w-0 flex-1 px-2 text-xs sm:px-3" onClick={() => wear({ itemIds: outfit.itemIds, occasion, score: outfit.score })}>
              <Check size={14} /> Wear<span className="hidden sm:inline"> today</span>
            </button>
          )}
          {children}
          <button className={cx('btn btn-secondary ml-auto size-8 shrink-0 px-0', fav ? 'text-rose-500' : 'text-muted')}
            onClick={() => toggleFavorite(outfit.itemIds)} aria-label={fav ? 'Remove from favorites' : 'Save to favorites'} aria-pressed={fav}>
            <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </article>
  );
}
