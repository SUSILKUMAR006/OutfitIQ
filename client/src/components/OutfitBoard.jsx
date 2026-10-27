// Flat-lay picture of an outfit: main pieces on the left, shoes / layer / watch / accessory on the right.
import { useAppData } from '../AppData.jsx';
import { cx } from '../lib/format.js';

function Tile({ item, large }) {
  return (
    <div className="relative min-h-0 overflow-hidden rounded-md bg-tile" title={item.name}>
      <img src={item.image} alt={item.name} loading="lazy" draggable={false}
        className={cx('absolute inset-0 size-full object-contain mix-blend-multiply', large ? 'p-4' : 'p-2')} />
    </div>
  );
}

export default function OutfitBoard({ itemIds, large = false, className }) {
  const { itemsById } = useAppData();
  const items = itemIds.map(id => itemsById.get(id)).filter(Boolean);
  const get = c => items.find(i => i.category === c);
  const main = get('onepiece') ? [get('onepiece')] : [get('top'), get('bottom')].filter(Boolean);
  const side = [get('outerwear'), get('shoes'), get('watch'), get('accessory')].filter(Boolean);
  const rows = n => ({ gridTemplateRows: `repeat(${Math.max(1, n)}, minmax(0, 1fr))` });

  return (
    <div className={cx('grid aspect-4/5 grid-cols-[3fr_2fr] rounded-lg bg-white', large ? 'gap-2.5 p-2.5' : 'gap-1.5 p-1.5', className)}>
      <div className={cx('grid min-h-0', large ? 'gap-2.5' : 'gap-1.5')} style={rows(main.length)}>
        {main.map(i => <Tile key={i.id} item={i} large={large} />)}
      </div>
      <div className={cx('grid min-h-0', large ? 'gap-2.5' : 'gap-1.5')} style={rows(side.length)}>
        {side.map(i => <Tile key={i.id} item={i} large={large} />)}
      </div>
    </div>
  );
}
