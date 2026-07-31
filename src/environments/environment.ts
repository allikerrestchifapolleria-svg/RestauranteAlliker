export const environment = {
  production: true,
  firebase: {
    apiKey: "AIzaSyB-iTgRAg4ZTeQTP-l_qK3_snsaVt-8hew",
    authDomain: "restaurante-37332.firebaseapp.com",
    projectId: "restaurante-37332",
    storageBucket: "restaurante-37332.appspot.com",
    messagingSenderId: "680135217480",
    appId: "1:680135217480:web:d8f4b39a704d9902ec637d"
  },
  culqi: {
    publicKey: 'pk_test_xxxxxxxxxxxx'
  },
  n8n: {
    // Workflow 2: registra la reserva, espera hasta fecha_alerta y devuelve el
    // access_token de Retell para iniciar la llamada de confirmacion por voz.
    createReservationWebhook:
      'https://alliker.app.n8n.cloud/webhook/c74b22c2-7cc7-40de-b60f-629afc42052e'
  }
};