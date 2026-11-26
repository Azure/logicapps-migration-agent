def key = [properties.getProperty("ISA06"), properties.getProperty("ISA13"), properties.getProperty("GS06"), properties.getProperty("ST02")].join("|")
properties.setProperty("idempotencyKey", key)
