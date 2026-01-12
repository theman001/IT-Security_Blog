export default async function render(container) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');

    let title = '404';
    let message = 'Page Not Found';
    let detail = 'The page you are looking for might have been removed or is temporarily unavailable.';

    switch (type) {
        case 'API_ERROR':
            title = '500';
            message = 'System Error';
            detail = 'Failed to connect to the database. Please try again later.';
            break;
        case 'TIMEOUT':
            title = '408';
            message = 'Connection Timeout';
            detail = 'The request took too long. Please check your internet connection.';
            break;
        case 'NetworkError':
            title = 'Offline';
            message = 'No Internet';
            detail = 'It looks like you are offline. Please check your connection.';
            break;
        case 'MODULE_ERROR':
            title = '500';
            message = 'Application Error';
            detail = 'Failed to load the page module. Please refresh the page.';
            break;
    }

    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 0;">
            <h1 style="font-size: 4rem; margin-bottom: 1rem; color: var(--link);">${title}</h1>
            <h2 style="margin-bottom: 1rem;">${message}</h2>
            <p style="color: var(--muted); margin-bottom: 2rem;">${detail}</p>
            <a href="/" data-link style="display: inline-block; padding: 0.8rem 1.5rem; background: var(--link); color: #fff; border-radius: var(--radius); transition: background 0.2s;">Go Home</a>
        </div>
    `;
}
