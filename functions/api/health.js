export async function onRequestGet(context) {
    // Retorna uma resposta JSON simples com o código HTTP 200 (OK)
    const data = {
        status: "ok",
        mensagem: "A infraestrutura de Pages Functions está a funcionar corretamente!"
    };

    return new Response(JSON.stringify(data), {
        headers: {
            "content-type": "application/json;charset=UTF-8"
        }
    });
}
