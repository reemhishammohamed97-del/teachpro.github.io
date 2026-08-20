function showTime() {
    const currentTime = document.getElementById('currentTime');

    if (!currentTime) {
        return;
    }

    currentTime.textContent = new Date().toLocaleString('ar-SA');
}

showTime();
setInterval(showTime, 1000);