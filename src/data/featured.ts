/**
 * The three items the home page leads with ("Start here") and the catering
 * page shows. Otter item ids, in display order — the same three, in the same
 * order, as the "Popular" section of the Otter storefront (issue #254). Kept
 * out of the client `FeaturedCards` component so a server page can read the
 * list too.
 */
export const FEATURED_OTTER_IDS = [
  "7bbcdf64-0e6f-489f-8ca4-0bee1e835bb0", // 2 Sliders and Fries — most ordered
  "d119da4a-bfc1-4913-8249-21dd96d58456", // 1 Slider and Fries
  "c191ef14-1142-4b82-a230-8fe5850bbb7f", // 2 Triples and Fries
] as const;
