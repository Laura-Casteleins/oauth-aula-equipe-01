// public/app.js

window.addEventListener("DOMContentLoaded", async () => {

  const statusText =
    document.getElementById("status-text");

  const loginButtons =
    document.getElementById("login-buttons");

  const userProfile =
    document.getElementById("user-profile");

  const userName =
    document.getElementById("user-name");

  const userEmail =
    document.getElementById("user-email");

  const userAvatar =
    document.getElementById("user-avatar");


  try {

    // --------------------------------------------------
    // Consultar sessão na mesma origem
    // --------------------------------------------------

    const response =
      await fetch(
        "/api/me",
        {
          credentials: "same-origin",
          cache: "no-store"
        }
      );


    // --------------------------------------------------
    // Sem sessão válida
    // --------------------------------------------------

    if (!response.ok) {

      statusText.textContent =
        "Não autenticado";

      loginButtons.style.display =
        "block";

      userProfile.style.display =
        "none";

      return;
    }


    // --------------------------------------------------
    // Sessão válida
    // --------------------------------------------------

    const user =
      await response.json();


    if (!user.authenticated) {

      statusText.textContent =
        "Não autenticado";

      loginButtons.style.display =
        "block";

      userProfile.style.display =
        "none";

      return;
    }


    // --------------------------------------------------
    // Mostrar estado autenticado
    // --------------------------------------------------

    statusText.textContent =
      "Autenticado";


    // Ocultar botões de login
    loginButtons.style.display =
      "none";


    // Mostrar perfil
    userProfile.style.display =
      "block";


    // Nome
    userName.textContent =
      user.displayName ??
      "Utilizador autenticado";


    // E-mail
    userEmail.textContent =
      user.email ?? "";


    // --------------------------------------------------
    // O laboratório não precisa fornecer avatar em
    // /api/me. Portanto ocultamos a imagem.
    // --------------------------------------------------

    if (userAvatar) {
      userAvatar.style.display =
        "none";
    }


  } catch (err) {

    console.error(
      "Erro ao verificar sessão:",
      err
    );


    statusText.textContent =
      "Erro ao verificar sessão";


    loginButtons.style.display =
      "block";


    userProfile.style.display =
      "none";
  }
});
