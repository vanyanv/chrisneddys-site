/** The admin's section tabs, in the order every `rack-topbar` draws them.
 * Each page still marks its own tab `aria-current`; the loading skeletons
 * hardcode the same labels (they can't import a list they don't render). */
export const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/closing", label: "Closing" },
  { href: "/admin/settings", label: "Settings" },
];
