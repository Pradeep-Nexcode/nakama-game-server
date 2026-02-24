FROM registry.heroiclabs.com/heroiclabs/nakama:3.22.0

COPY ./data /nakama/data

CMD ["/bin/sh", "-ecx", "\
 /nakama/nakama migrate up --database.address ${DATABASE_URL} && \
 exec /nakama/nakama \
 --name nakama1 \
 --database.address ${DATABASE_URL} \
 --logger.level INFO \
 --session.token_expiry_sec 7200 \
 --runtime.path \"/nakama/data/modules\" \
 --runtime.js_entrypoint \"main.js\" \
 "]
