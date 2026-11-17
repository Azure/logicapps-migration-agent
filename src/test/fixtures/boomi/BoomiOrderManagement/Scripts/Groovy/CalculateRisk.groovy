// Synthetic migration test script
def amount = (properties.getProperty("amount") ?: "0") as BigDecimal
properties.setProperty("riskBand", amount >= 10000 ? "HIGH" : "NORMAL")
