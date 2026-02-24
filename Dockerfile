FROM registry.heroiclabs.com/heroiclabs/nakama:3.22.0

COPY ./data /nakama/data

ENTRYPOINT ["/bin/sh","-c"]

CMD /nakama/nakama migrate up --database.address "$DATABASE_URL" && \
exec /nakama/nakama \
--name nakama1 \
--database.address "$DATABASE_URL" \
--logger.level INFO \
--runtime.path "/nakama/data/modules" \
--runtime.js_entrypoint "main.js" \
--socket.port=$PORT \
--console.port=$PORT \
--console.address=0.0.0.0