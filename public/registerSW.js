if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
    caches.keys().then(names => {
        for (let name of names) caches.delete(name);
    });
}
