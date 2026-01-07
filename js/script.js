function openModal(type) {
    document.getElementById(type + '-modal').style.display = 'block';
}
function closeModal(type) {
    document.getElementById(type + '-modal').style.display = 'none';
}
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}