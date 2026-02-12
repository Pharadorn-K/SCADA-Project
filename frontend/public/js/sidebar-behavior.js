// frontend/public/js/sidebar-behavior.js
export function initSidebarBehavior(navigate) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('click', (e) => {
    const toggleLink = e.target.closest('li.sub-menu > a');
    if (!toggleLink) return;

    e.preventDefault();

    const layout = document.querySelector('.layout');

    // If collapsed → expand only
    if (layout.classList.contains('sidebar-collapsed')) {
      layout.classList.remove('sidebar-collapsed');
      return;
    }

    const parentLi = toggleLink.parentElement;
    const submenu = parentLi.querySelector(':scope > ul');
    if (!submenu) return;

    // Close siblings at SAME LEVEL only
    parentLi.parentElement
      .querySelectorAll(':scope > li.sub-menu')
      .forEach(li => {
        if (li !== parentLi) {
          const ul = li.querySelector(':scope > ul');
          if (ul) ul.style.display = 'none';
          li.classList.remove('open');
        }
      });

    // Toggle current
    const isOpen = submenu.style.display === 'block';
    submenu.style.display = isOpen ? 'none' : 'block';
    parentLi.classList.toggle('open', !isOpen);
  });

  // Navigation (leaf nodes)
  sidebar.addEventListener('click', (e) => {
    const pageLink = e.target.closest('a[data-page]');
    if (!pageLink) return;

    e.preventDefault();
    navigate(pageLink.dataset.page);
    setActiveSidebar(pageLink.dataset.page);
  });
}


export function setActiveSidebar(page) {
  document.querySelectorAll('#leftside-navigation li')
    .forEach(li => li.classList.remove('active'));

  const activeLink = document.querySelector(`a[data-page="${page}"]`);
  if (!activeLink) return;

  let li = activeLink.closest('li');
  while (li) {
    li.classList.add('active');
    li = li.parentElement.closest('li');
  }

  // ensure parents are open
  document.querySelectorAll('.sub-menu.active > ul')
    .forEach(ul => ul.style.display = 'block');
}
