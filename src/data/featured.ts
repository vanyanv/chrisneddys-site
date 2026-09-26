/**
 * The three items the home page leads with ("Start here") and the catering
 * page shows. Otter item ids, in display order. Kept out of the client
 * `FeaturedCards` component so a server page can read the list too.
 */
export const FEATURED_OTTER_IDS = [
  "7bbcdf64-0e6f-489f-8ca4-0bee1e835bb0", // 2 Sliders and Fries — most ordered
  "de38e42c-7600-473f-913f-acb6b2a45aa8", // Chris N Eddy's Slider — the signature
  "43d72be5-d38f-459d-9306-4c45f512715a", // The Quad — the secret-menu hook
] as const;
