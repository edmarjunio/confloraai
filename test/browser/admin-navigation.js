async function openAdminSection(page, tab) {
  await page.locator('conflora-topbar .cf-topbar-menu').click();
  await page.locator('#siteNavigationDrawer a[href="/admin?tab=' + tab + '"]').click();
}
module.exports = { openAdminSection };
