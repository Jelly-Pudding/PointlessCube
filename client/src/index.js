import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Keycloak from 'keycloak-js';

// Determine if we're in development or production
const isDevelopment = process.env.NODE_ENV === 'development';

// Use different URLs based on environment
const keycloakUrl = isDevelopment 
  ? 'http://localhost:8080/auth'
  : 'https://www.minecraftoffline.net/auth';

const redirectUri = isDevelopment
  ? 'http://localhost:3000/'
  : 'https://www.minecraftoffline.net/game/';

console.log('Environment:', process.env.NODE_ENV);
console.log('Using Keycloak URL:', keycloakUrl);
console.log('Using redirect URI:', redirectUri);

const keycloak = new Keycloak({
  url: keycloakUrl,
  realm: 'myrealm',
  clientId: 'my-app'
});

keycloak.init({
  onLoad: 'login-required',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  checkLoginIframe: false,
  redirectUri: redirectUri
}).then((authenticated) => {
  if (!authenticated) {
    console.log('User not authenticated!');
  } else {
    console.log('User authenticated');
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App keycloak={keycloak} />
    </React.StrictMode>
  );
}).catch(e => {
  console.error('Failed to initialize Keycloak', e);
});
