// Ao carregar a página, verifica se o utilizador está autenticado via /api/me
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();

        if (data.authenticated) {
            document.getElementById('status-text').textContent = 'Autenticado';
            document.getElementById('login-buttons').style.display = 'none';
            
            // Exibir dados do perfil
            document.getElementById('user-profile').style.display = 'block';
            document.getElementById('user-name').textContent = data.user.name;
            document.getElementById('user-email').textContent = data.user.email || data.user.username || '';
            if (data.user.avatar_url || data.user.picture) {
                document.getElementById('user-avatar').src = data.user.avatar_url || data.user.picture;
            }
        } else {
            document.getElementById('status-text').textContent = 'Não autenticado';
        }
    } catch (err) {
        document.getElementById('status-text').textContent = 'Erro ao verificar sessão';
    }
});
