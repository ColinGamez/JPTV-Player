import type { Category } from '../data/mockData';
import styles from './CategoryRail.module.css';

interface CategoryRailProps {
  categories: Category[];
  selectedIndex: number;
  focused: boolean;
}

function CategoryRail({ categories, selectedIndex, focused }: CategoryRailProps) {
  return (
    <div className={`${styles.rail} ${focused ? styles.focused : ''}`}>
      <div className={styles.header}>カテゴリー</div>
      <div className={styles.list}>
        {categories.map((category, index) => (
          <div
            key={category.name}
            className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
          >
            <span className={styles.name}>{category.name}</span>
            <span className={styles.count}>{category.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategoryRail;
