(function () {
    function showTime() {
        const currentTime = document.getElementById('currentTime');

        if (currentTime) {
            currentTime.textContent = new Date().toLocaleString('ar-SA');
        }
    }

    function startClock() {
        showTime();

        if (document.getElementById('currentTime')) {
            setInterval(showTime, 1000);
        }
    }

    function loadExternalStyles() {
        if (document.querySelector('link[data-external-styles]')) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'styles.css';
        link.dataset.externalStyles = 'true';
        document.head.appendChild(link);
    }

    function getLocalMonth() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function patchAttendance() {
        if (typeof window.loadStudentsForAttendance !== 'function') {
            return;
        }

        const originalLoader = window.loadStudentsForAttendance;

        window.loadStudentsForAttendance = function () {
            originalLoader();

            document.querySelectorAll('#attendanceList > div').forEach(row => {
                row.classList.add('attendance-row');
            });
        };
    }

    function patchScheduleSelect() {
        const scheduleSelect = document.getElementById('schClass');

        if (scheduleSelect && !scheduleSelect.dataset.listenerAttached) {
            scheduleSelect.addEventListener('change', () => {
                if (typeof window.renderSchedule === 'function') {
                    window.renderSchedule();
                }
            });

            scheduleSelect.dataset.listenerAttached = 'true';
        }
    }

    function initialize() {
        loadExternalStyles();
        patchAttendance();
        patchScheduleSelect();
        startClock();

        if (typeof window.renderDashboard === 'function') {
            const originalRenderDashboard = window.renderDashboard;

            window.renderDashboard = function () {
                originalRenderDashboard();

                const dashboard = document.getElementById('dashboardContent');
                if (dashboard && typeof window.DB !== 'undefined') {
                    const month = getLocalMonth();
                    const reports = Array.isArray(window.DB.reports)
                        ? window.DB.reports.filter(report => report.date.startsWith(month))
                        : [];

                    const monthLessons = dashboard.querySelector('.bg-green-50 p');
                    if (monthLessons) {
                        monthLessons.textContent = reports.length;
                    }
                }
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();