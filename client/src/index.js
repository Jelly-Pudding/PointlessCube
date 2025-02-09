import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'https://www.minecraftoffline.net/auth',
  realm: 'myrealm',
  clientId: 'my-app'
});

keycloak.init({
  onLoad: 'login-required',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  checkLoginIframe: false,
  // Change redirectUri to point to /game so that only the Cube Game triggers Keycloak
  redirectUri: 'https://www.minecraftoffline.net/game/'
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
