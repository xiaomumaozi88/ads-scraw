export const DOMESTIC_AD_SIZE_GROUPS = [
  {
    label: '高清(宽度>700)',
    options: [
      { value: '1332 x 750', label: '1332 x 750' },
      { value: '1280 x 720', label: '1280 x 720' },
      { value: '1140 x 640', label: '1140 x 640' },
      { value: '1080 x 1920', label: '1080 x 1920' },
      { value: '750 x 750', label: '750 x 750' },
      { value: '720 x 1280', label: '720 x 1280' },
    ],
  },
  {
    label: '标清(宽度<700)',
    options: [
      { value: '640 x 360', label: '640 x 360' },
      { value: '600 x 300', label: '600 x 300' },
      { value: '400 x 200', label: '400 x 200' },
      { value: '370 x 245', label: '370 x 245' },
      { value: '280 x 200', label: '280 x 200' },
    ],
  },
];

export const DOMESTIC_AD_SIZE_LABEL_MAP = (() => {
  const m = {};
  DOMESTIC_AD_SIZE_GROUPS.forEach((group) => {
    group.options.forEach((item) => {
      m[item.value] = item.label;
    });
  });
  return m;
})();
