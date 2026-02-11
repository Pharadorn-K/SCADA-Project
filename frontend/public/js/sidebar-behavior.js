// frontend/public/js/sidebar-behavior.js
// export function initSidebarBehavior(navigate) {
//   const sidebar = document.querySelector('.sidebar');

//   // Toggle collapse
//   document.getElementById('toggleSidebar')?.addEventListener('click', () => {
//     sidebar.classList.toggle('collapsed');

//     // close all submenus when collapsed
//     if (sidebar.classList.contains('collapsed')) {
//       document.querySelectorAll('.sub-menu ul').forEach(ul => {
//         ul.style.display = 'none';
//       });
//     }
//   });

//   // Handle submenu toggle
//   sidebar.addEventListener('click', (e) => {
//     const link = e.target.closest('.sub-menu > a');
//     if (!link) return;

//     e.preventDefault();

//     if (sidebar.classList.contains('collapsed')) {
//       sidebar.classList.remove('collapsed');
//       return;
//     }

//     const parent = link.parentElement;
//     const submenu = parent.querySelector('ul');

//     // close siblings
//     // parent.parentElement.querySelectorAll(':scope > .sub-menu').forEach(li => {
//     //   if (li !== parent) li.querySelector('ul')?.style.display = 'none';
//     // });
// parent.parentElement.querySelectorAll(':scope > .sub-menu').forEach(li => {
// if (li !== parent) {
// const ul = li.querySelector('ul');
// if (ul) ul.style.display = 'none';
// }
// });

//     submenu.style.display =
//       submenu.style.display === 'block' ? 'none' : 'block';
//   });

//   // Handle navigation clicks
//   sidebar.addEventListener('click', (e) => {
//     const pageLink = e.target.closest('a[data-page]');
//     if (!pageLink) return;

//     e.preventDefault();
//     setActiveSidebar(pageLink.dataset.page);
//     navigate(pageLink.dataset.page);
//   });
// }
// frontend/public/js/sidebar-behavior.js
// sidebar-behavior.js
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
