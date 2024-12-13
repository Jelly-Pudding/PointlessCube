import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'myrealm',
  clientId: 'my-app'
});

keycloak.init({ onLoad: 'login-required' }).then((authenticated) => {
  if (!authenticated) {
    console.log('User not authenticated!');
  } else {
    console.log('User authenticated');
  }

  // Once Keycloak is initialized and the user is authenticated (or attempted),
  // render the app and pass the Keycloak instance.
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App keycloak={keycloak} />
    </React.StrictMode>
  );
}).catch(e => {
  console.error('Failed to initialize Keycloak', e);
});

// For performance:
reportWebVitals();
