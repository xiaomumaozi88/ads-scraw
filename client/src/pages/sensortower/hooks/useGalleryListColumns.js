import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAllConfigurableListColumnIds,
  getDefaultVisibleListColumns,
} from '../constants/galleryListColumns.js';
import {
  loadVisibleListColumns,
  saveVisibleListColumns,
} from '../utils/galleryListColumnsStorage.js';

const ALL_IDS = getAllConfigurableListColumnIds();

export function useGalleryListColumns() {
  const [visibleColumns, setVisibleColumns] = useState(() => loadVisibleListColumns());

  useEffect(() => {
    saveVisibleListColumns(visibleColumns);
  }, [visibleColumns]);

  const selectionState = useMemo(() => {
    const checkedCount = ALL_IDS.filter((id) => visibleColumns.has(id)).length;
    const allChecked = checkedCount === ALL_IDS.length;
    const noneChecked = checkedCount === 0;
    return {
      allChecked,
      indeterminate: !allChecked && !noneChecked,
      checkedCount,
      totalCount: ALL_IDS.length,
    };
  }, [visibleColumns]);

  const isColumnVisible = useCallback((id) => visibleColumns.has(id), [visibleColumns]);

  const toggleColumn = useCallback((id) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAllColumns = useCallback((checked) => {
    setVisibleColumns(checked ? new Set(ALL_IDS) : new Set());
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumns(getDefaultVisibleListColumns());
  }, []);

  return {
    visibleColumns,
    selectionState,
    isColumnVisible,
    toggleColumn,
    setAllColumns,
    resetColumns,
  };
}
