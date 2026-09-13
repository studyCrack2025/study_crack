document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.getElementById('basicExampleDialog');
    document.getElementById('basicExampleCriteria').addEventListener('click', () => dialog.showModal());
    document.getElementById('basicExampleDialogClose').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.getElementById('mobileNavPanel').classList.contains('active')) window.closeMobileNav();
    });
});
