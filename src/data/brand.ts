export const brand = {
  name: "Chris N Eddy's",
  tagline: "Two childhood friends in a parking lot with dreams of sliders.",
  phone: "(323) 544-3600",
  phoneTel: "+13235443600",
  email: "chris@chrisneddys.com",
  ig: "@chrisneddys",
  igUrl: "https://www.instagram.com/chrisneddys/",
  /**
   * The canonical storefront slug. The old `chris-n-eddys-(3pd)` slug returns
   * the same store at the same prices, but this is the URL the storefront
   * considers its own. Per-item links are built in `@/lib/otter`.
   */
  orderUrl:
    "https://order.tryotter.com/s/chris-n-eddys/5539-sunset-boulevard-los-angeles/8c836303-8d5d-4c32-b9d1-a1ca5325b191",
  founded: 2020,
  festivalsPerYear: 100,
  siteUrl: "https://www.chrisneddys.com",
} as const;
