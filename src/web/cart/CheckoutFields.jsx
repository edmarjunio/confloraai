import { useState } from "react";
import { Field, Select } from "../shared/ui.jsx";
export function CustomerFields({ pdv = false, checkout }) {
  const [fulfillment, setFulfillment] = useState("pickup");
  return (
    <>
      <Field
        label={"checkout.name".tr}
        name="name"
        required
        autoComplete="name"
      />
      <Field
        label={"checkout.phone".tr}
        name="phone"
        type="tel"
        autoComplete="tel"
        required={!pdv}
      />
      <Select
        label={"checkout.fulfillment".tr}
        name="fulfillment"
        value={fulfillment}
        onChange={(event) => setFulfillment(event.target.value)}
      >
        {(pdv || checkout?.pickup?.enabled !== false) && (
          <option value="pickup">{"checkout.pickup".tr}</option>
        )}
        {(pdv || checkout?.delivery?.enabled) && (
          <option value="delivery">{"checkout.delivery".tr}</option>
        )}
      </Select>
      {fulfillment === "delivery" && (
        <>
          <Field
            label={"checkout.address".tr}
            name="address"
            required
            autoComplete="street-address"
          />
          {!!checkout?.delivery?.serviceAreas?.length && (
            <Select label={"checkout.area".tr} name="serviceArea" required>
              {checkout.delivery.serviceAreas.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </Select>
          )}
          {pdv && (
            <Field
              label={"cart.freight".tr}
              name="freightValue"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
            />
          )}
        </>
      )}
    </>
  );
}
export function PaymentFields({
  pdv = false,
  payments = ["PIX", "CARD", "CASH"],
}) {
  const [method, setMethod] = useState(payments[0] || "CASH");
  const labels = {
    PIX: "checkout.pix".tr,
    CARD: "checkout.card".tr,
    CASH: "checkout.cash".tr,
  };
  return (
    <>
      <Select
        label={"checkout.payment".tr}
        name="paymentMethod"
        value={method}
        onChange={(event) => setMethod(event.target.value)}
      >
        {payments.map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </Select>
      {method === "CASH" && (
        <Field
          label={"checkout.tendered".tr}
          type="number"
          name="cash"
          min="0"
          step="0.01"
          required
        />
      )}
      {pdv && (
        <Field
          label={"cart.discount".tr}
          type="number"
          name="discountPercent"
          min="0"
          max="100"
          step="0.01"
          defaultValue="0"
        />
      )}
    </>
  );
}
