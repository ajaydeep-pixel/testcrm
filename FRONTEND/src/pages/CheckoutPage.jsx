import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { billingAPI } from "../services/api";
import TenantCommonHeader from "../components/TenantCommonHeader";
import { useToast } from "../components/Toast";

export default function CheckoutPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    async function fetchPlan() {
      setLoading(true);
      try {
        const res = await billingAPI.get(`/plans/${id}`);
        setPlan(res.data.plan);
        setHasActiveSubscription(res.data.hasActiveSubscription);
        setSubscription(res.data.subscription);
      } catch (err) {
        toast.error("Failed to load plan");
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();
  }, [id, toast]);

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const res = await billingAPI.post(`/checkout/${id}`);
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to start checkout");
    } finally {
      setProcessing(false);
    }
  };

  /* ---------------- LOADING ---------------- */

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "4px solid #e5e7eb",
              borderTop: "4px solid #2563eb",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          ></div>
          <p style={{ color: "#6b7280" }}>Loading checkout...</p>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!plan) return null;

  const billingCycleLabel = plan.billingCycle === "yearly" ? "year" : "month";

  /* ---------------- PAGE ---------------- */

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "40px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <TenantCommonHeader />

        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Checkout</h1>
          <p style={{ color: "#6b7280", marginTop: 8 }}>
            Review your plan and proceed to payment
          </p>
        </div>

        {/* ACTIVE SUBSCRIPTION WARNING */}
        {hasActiveSubscription && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              display: "flex",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>⚠</span>
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>Active Subscription Detected</p>
              <p style={{ margin: "4px 0", fontSize: 14 }}>
                You currently have an active <strong>{subscription?.plan}</strong> plan.
              </p>

              {subscription?.subscription?.currentPeriodEnd && (
                <p style={{ fontSize: 13 }}>
                  Active until{" "}
                  <strong>
                    {new Date(
                      subscription.subscription.currentPeriodEnd
                    ).toLocaleDateString()}
                  </strong>
                </p>
              )}

              <button
                onClick={() => navigate("/dashboard")}
                style={{
                  marginTop: 8,
                  background: "#f59e0b",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Go to Dashboard to Cancel
              </button>
            </div>
          </div>
        )}

        {/* MAIN GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          
          {/* PLAN DETAILS */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Plan Details</h2>

            <div
              style={{
                background: "#eff6ff",
                borderRadius: 8,
                padding: 16,
                marginTop: 12,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700 }}>{plan.name} Plan</div>

              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 32, fontWeight: 800 }}>${plan.price}</span>
                <span style={{ color: "#6b7280" }}>/{billingCycleLabel}</span>
              </div>

              {plan.description && (
                <p style={{ fontSize: 14, marginTop: 8 }}>{plan.description}</p>
              )}
            </div>

            <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
              {[
                { label: "Users", value: plan.features?.maxUsers },
                { label: "Branches", value: plan.features?.maxBranches },
                {
                  label: "Products",
                  value: plan.features?.maxProducts?.toLocaleString(),
                },
                {
                  label: "Invoices/month",
                  value: plan.features?.maxInvoicesPerMonth?.toLocaleString(),
                },
              ].map((f) => (
                <li key={f.label} style={{ padding: "8px 0", fontSize: 14 }}>
                  ✔ {f.label}: <strong>{f.value}</strong>
                </li>
              ))}
            </ul>
          </div>

          {/* BILLING SUMMARY */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Billing Summary</h2>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{plan.name}</span>
                <span>
                  ${plan.price}/{billingCycleLabel}
                </span>
              </div>

              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  marginTop: 12,
                  paddingTop: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Subtotal</span>
                  <span>${plan.price}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tax</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  marginTop: 12,
                  paddingTop: 12,
                  fontWeight: 700,
                  fontSize: 18,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Total</span>
                <span>
                  ${plan.price}/{billingCycleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 32,
          }}
        >
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              border: "1px solid #d1d5db",
              background: "#fff",
              padding: "12px 24px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>

          <button
            onClick={handleCheckout}
            disabled={processing || hasActiveSubscription}
            style={{
              background: hasActiveSubscription ? "#9ca3af" : "#2563eb",
              color: "#fff",
              border: "none",
              padding: "12px 32px",
              borderRadius: 8,
              cursor: hasActiveSubscription ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {processing
              ? "Redirecting..."
              : hasActiveSubscription
              ? "Cancel Current Plan First"
              : `Subscribe - $${plan.price}/${billingCycleLabel}`}
          </button>
        </div>

        {/* FOOTER */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12 }}>
          <p>You can cancel anytime from your dashboard.</p>
        </div>
      </div>

      <style>{`
        @media (max-width:768px){
          div[style*="gridTemplateColumns"]{
            grid-template-columns:1fr !important;
          }
        }
      `}</style>
    </div>
  );
}