export const renderErrorPage = () => `
  <!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Algo deu errado</title>
      <style>
        body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0d1117; color: white; }
        .container { text-align: center; }
        h1 { font-size: 2rem; margin-bottom: 1rem; }
        p { color: #8b949e; margin-bottom: 2rem; }
        a { color: #58a6ff; text-decoration: none; border: 1px solid #30363d; padding: 0.5rem 1rem; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Ops! Algo deu errado</h1>
        <p>Não conseguimos carregar esta página no momento.</p>
        <a href="/">Voltar para o início</a>
      </div>
    </body>
  </html>
`;
