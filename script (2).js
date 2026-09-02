(function () {
    function showTime() {
        const currentTime = document.getElementById('currentTime');

        if (!currentTime) {
            return;
        }

        currentTime.textContent = new Date().toLocaleString('ar-SA');
    }

    function startClock() {
        showTime();

        if (document.getElementById('currentTime')) {
            setInterval(showTime, 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startClock);
    } else {
        startClock();
    }
})();