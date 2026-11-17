// Synthetic migration-test logic only
def required = ["ISA06","ISA08","ISA13","GS06","ST02"]
def missing = required.findAll { !properties.getProperty(it) }
properties.setProperty("envelopeValid", missing.isEmpty().toString())
properties.setProperty("missingFields", missing.join(","))
