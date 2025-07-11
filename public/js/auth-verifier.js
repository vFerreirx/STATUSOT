import { auth } from './firebase-config.js';

export const verifyAuth = () => {
  return new Promise((resolve, reject) => {
    console.log("Iniciando verificação de autenticação...");
    
    // Verificação imediata caso já esteja autenticado
    if (auth.currentUser) {
      console.log("Usuário já autenticado:", auth.currentUser.email);
      return resolve(auth.currentUser);
    }

    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      if (user) {
        console.log("Usuário autenticado via estado:", user.email);
        resolve(user);
      } else {
        console.warn("Usuário não autenticado. Redirecionando...");
        window.location.href = "admin.html";
        reject(new Error("Não autenticado"));
      }
    }, error => {
      unsubscribe();
      console.error("Erro na verificação:", error);
      window.location.href = "admin.html";
      reject(error);
    });
  });
};