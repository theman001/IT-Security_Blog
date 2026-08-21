import { renderErrorState } from '../assets/js/components.js';

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

    container.innerHTML = renderErrorState({ title, message, detail });
}
