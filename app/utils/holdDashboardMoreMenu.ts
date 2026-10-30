/**
 * The overlay "more" menu lives on the page instance. A locale switch replaces
 * the URL and recreates that page, which would close the menu. The account
 * menu stays open because its flag lives outside the page. This holds the
 * overlay menu open across that one recreation.
 */
let restoreMenu = false;

const holdDashboardMoreMenu = {
  arm() {
    restoreMenu = true;
  },
  take() {
    const restored = restoreMenu;
    restoreMenu = false;
    return restored;
  },
};

export default holdDashboardMoreMenu;
