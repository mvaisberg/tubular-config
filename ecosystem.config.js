// PM2 process config. Cluster mode con 2 workers da zero-downtime reload:
// pm2 reload tubular-configurador → spawnea workers nuevos, espera que estén
// listening, y recién ahí mata los viejos. Sin gap, sin 502.
//
// Deploy nuevo:
//   npm run build && pm2 reload tubular-configurador

module.exports = {
    apps: [{
        name: 'tubular-configurador',
        script: 'node_modules/next/dist/bin/next',
        args: 'start -p 3000',
        // Se pasa como execArgv del intérprete (llega a los workers de cluster al
        // arrancar). NODE_OPTIONS via env NO alcanza en cluster mode porque PM2
        // inyecta el env después de que Node ya fijó el límite de headers.
        node_args: '--max-http-header-size=65536',
        instances: 2,
        exec_mode: 'cluster',
        cwd: '/var/www/tubular-configurador',
        wait_ready: false,
        listen_timeout: 10000,
        kill_timeout: 5000,
        max_memory_restart: '600M',
        env: {
            NODE_ENV: 'production',
            PORT: '3000',
            // Permite request lines (URLs) largas del configurador (?config=base64).
            // Alineado con nginx large_client_header_buffers (64k). Default de Node = 16k.
            NODE_OPTIONS: '--max-http-header-size=65536',
            // El VPS está en Asia/Shanghai (+8). El manager renderiza fechas en el
            // server (dashboard, informes) → forzar hora Argentina para este proceso.
            TZ: 'America/Argentina/Buenos_Aires',
        },
        error_file: '/var/log/tubular-configurador/error.log',
        out_file: '/var/log/tubular-configurador/out.log',
        merge_logs: true,
        time: true,
    }],
};
