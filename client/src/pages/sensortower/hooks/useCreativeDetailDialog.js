import { useEffect, useMemo, useState } from 'react';
import { fetchCreativeDialogBundle } from '../utils/galleryApi.js';

export function useCreativeDetailDialog({ open, creative, filters, isLoggedIn }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [variants, setVariants] = useState([]);
  const [shareSeries, setShareSeries] = useState([]);
  const [shareTimeSeries, setShareTimeSeries] = useState([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  useEffect(() => {
    if (!open || !creative || !isLoggedIn) {
      setDetail(null);
      setVariants([]);
      setShareSeries([]);
      setShareTimeSeries([]);
      setSelectedVariantIndex(0);
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setSelectedVariantIndex(0);

    fetchCreativeDialogBundle(filters, creative)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError(result.message || '创意详情加载失败');
          setDetail(null);
          setVariants([]);
          setShareSeries([]);
          setShareTimeSeries([]);
          return;
        }
        setDetail(result.detail);
        setVariants(result.variants ?? []);
        setShareSeries(result.shareSeries ?? []);
        setShareTimeSeries(result.shareTimeSeries ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || String(e));
        setDetail(null);
        setVariants([]);
        setShareSeries([]);
        setShareTimeSeries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    isLoggedIn,
    filters,
    creative?.unified_app_id,
    creative?.grouped_creative_id,
    creative?.network,
  ]);

  const mergedCreative = useMemo(() => {
    if (!creative) return null;
    if (!detail) return creative;
    return { ...creative, ...detail };
  }, [creative, detail]);

  const selectedVariant = variants[selectedVariantIndex] ?? variants[0] ?? null;

  return {
    loading,
    error,
    mergedCreative,
    variants,
    selectedVariant,
    selectedVariantIndex,
    setSelectedVariantIndex,
    shareSeries,
    shareTimeSeries,
  };
}
