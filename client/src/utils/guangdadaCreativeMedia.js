export const GUANGDADA_PLAYABLE_AD_THUMBNAIL =
  'https://nbs-bj-global.zingfront.com/app/v1/static/media/playable-ad.793b46af51adf0d2f3c5.webp';

function trimUrl(value) {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return '';
  const markdownLink = raw.match(/^\[[^\]]*]\((https?:\/\/[^)\s]+)\)$/i);
  if (markdownLink) return markdownLink[1].trim();
  const firstUrl = raw.match(/https?:\/\/[^\s)\]]+/i);
  return firstUrl ? firstUrl[0].trim() : raw;
}

function firstResource(resources, predicate) {
  return resources.find((resource) => resource && predicate(resource)) || null;
}

export function getGuangdadaCreativeMedia(item) {
  const resources = Array.isArray(item?.resource_urls) ? item.resource_urls : [];
  const first = resources[0] || null;
  const playableResource = firstResource(
    resources,
    (resource) => Number(resource?.type) === 7 && trimUrl(resource?.html_url)
  );
  const htmlResource = firstResource(
    resources,
    (resource) => Number(resource?.type) === 4 && trimUrl(resource?.html_url)
  );
  const videoResource = firstResource(
    resources,
    (resource) => trimUrl(resource?.video_url) || Number(resource?.type) === 2
  );
  const imageResource = firstResource(
    resources,
    (resource) => trimUrl(resource?.image_url)
  );
  const primaryResource = playableResource || htmlResource || videoResource || imageResource || first;

  const playableHtmlUrl = trimUrl(playableResource?.html_url)
    || (Number(item?.ads_type) === 7 ? trimUrl(primaryResource?.html_url) : '');
  const htmlUrl = trimUrl(htmlResource?.html_url);
  const isPlayableAd =
    Number(item?.ads_type) === 7 ||
    Number(primaryResource?.type) === 7 ||
    Boolean(playableHtmlUrl);
  const rawVideoUrl = trimUrl(videoResource?.video_url ?? primaryResource?.video_url);
  const isHtml = Boolean(htmlUrl);
  const isVideo =
    !isPlayableAd &&
    !isHtml &&
    (Number(item?.ads_type) === 2 || Number(videoResource?.type) === 2 || rawVideoUrl !== '');

  let thumbnailUrl = '';
  if (isPlayableAd) {
    thumbnailUrl =
      trimUrl(item?.preview_img_url) ||
      trimUrl(playableResource?.image_url) ||
      trimUrl(primaryResource?.image_url) ||
      GUANGDADA_PLAYABLE_AD_THUMBNAIL;
  } else if (isVideo) {
    thumbnailUrl =
      trimUrl(item?.preview_img_url) ||
      trimUrl(videoResource?.image_url) ||
      trimUrl(primaryResource?.image_url);
  } else {
    thumbnailUrl =
      trimUrl(imageResource?.image_url) ||
      trimUrl(primaryResource?.image_url) ||
      trimUrl(item?.preview_img_url);
  }

  return {
    thumbnailUrl,
    videoUrl: rawVideoUrl,
    isVideo,
    hasPlayableVideo: Boolean(rawVideoUrl) && isVideo,
    htmlUrl,
    playableHtmlUrl,
    downloadHtmlUrl: playableHtmlUrl || htmlUrl,
    isPlayableAd,
  };
}
