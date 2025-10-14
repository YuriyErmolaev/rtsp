FROM coturn/coturn:4.6.2

# Copy templated config and entrypoint
COPY --chmod=0755 config /coturn/config

ENTRYPOINT ["/coturn/config/entrypoint.sh"]

