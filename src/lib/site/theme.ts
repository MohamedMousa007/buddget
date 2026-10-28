export const SITE_THEME_KEY = 'buddget-site-theme'

/** Runs in <head> before paint. The marketing site opens dark unless the visitor chose light. */
export const SITE_THEME_SCRIPT = `(function(){try{if(localStorage.getItem('${SITE_THEME_KEY}')!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}})()`
