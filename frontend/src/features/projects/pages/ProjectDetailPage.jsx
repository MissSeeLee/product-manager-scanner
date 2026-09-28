import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getProject } from "../api/projectsApi";
import StatusBadge from "../../inventory/components/StatusBadge";
import { OPERATION_CONFIG } from "../../operations/operationConfig";
import { formatDate, formatDateTime } from "../../../shared/lib/formatters";
import { FeedbackMessage, LoadingState } from "../../../shared/components/PageState";

function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getProject(id)
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || "ไม่สามารถโหลดรายละเอียดโครงการได้");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function toggleAsset(assetId) {
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((value) => value !== assetId)
        : [...current, assetId],
    );
  }

  function openSelectedReturn(event) {
    setError("");

    const selectedAssetsForReturn = assets.filter(
      (item) =>
        selectedIds.includes(Number(item.id)) &&
        item.current_status === "IN_USE",
    );

    const assetIds = selectedAssetsForReturn.map((item) => Number(item.id));

    if (assetIds.length === 0) {
      setError("กรุณาเลือกอุปกรณ์ที่กำลังใช้งานอย่างน้อย 1 รายการ");
      return;
    }

    const sourceIds = [
      ...new Set(
        selectedAssetsForReturn
          .map((item) => Number(item.current_issue_operation_id))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ];

    const hasMissingSource = selectedAssetsForReturn.some((item) => {
      const value = Number(item.current_issue_operation_id);

      return !Number.isInteger(value) || value <= 0;
    });

    if (hasMissingSource) {
      setError(
        "ไม่พบข้อมูลใบเบิกต้นทางของอุปกรณ์ที่เลือก กรุณาเปิดใบเบิกต้นทางแล้วรับคืนจากใบนั้น",
      );
      return;
    }

    if (sourceIds.length !== 1) {
      setError(
        "อุปกรณ์ที่เลือกมาจากหลายใบเบิก กรุณาเลือกอุปกรณ์จากใบเบิกเดียวกันเพื่อรับคืน",
      );
      return;
    }

    const sourceOperationId = sourceIds[0];

    sessionStorage.setItem(
      "assetops.pending-operation-selection.v6",
      JSON.stringify({
        version: 1,
        type: "RETURN",
        assetIds,
        selectedAssets: selectedAssetsForReturn,
        createdAt: Math.round(performance.timeOrigin + event.timeStamp),
      }),
    );

    navigate(
      `/operations/new?type=RETURN&assetIds=${encodeURIComponent(assetIds.join(","))}`,
      {
        state: {
          assetIds,
          selectedAssets: selectedAssetsForReturn,
          sourceOperationId,
          projectId: project.id,
        },
      },
    );
  }
  if (loading) {
    return <LoadingState message="กำลังโหลดโครงการ..." />;
  }

  if (!data) {
    return <FeedbackMessage type="error">{error || "ไม่พบโครงการ"}</FeedbackMessage>;
  }

  const { project, assets, operations } = data;
  const returnableSelected = assets
    .filter((item) => selectedIds.includes(Number(item.id)) && item.current_status === "IN_USE")
    .map((item) => Number(item.id));
  const overdueCount = assets.filter(
    (item) => item.current_status === "IN_USE" && item.expected_return_date && new Date(`${item.expected_return_date}T00:00:00`) < new Date(new Date().toDateString()),
  ).length;

  return (
    <>
      <div className="page-header project-detail-header">
        <div>
          <Link to="/projects" className="text-link">← โครงการทั้งหมด</Link>
          <h1 className="page-title">{project.project_name}</h1>
          <p className="page-description">
            {[project.project_code, project.responsible_person, project.default_location].filter(Boolean).join(" · ")}
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={() => navigate("/operations/new?type=ISSUE", { state: { projectId: project.id } })}
        >
          + เบิกอุปกรณ์เข้าโครงการ
        </button>
      </div>

      <FeedbackMessage type="error">{error}</FeedbackMessage>

      <section className="project-overview-strip">
        <div>
          <span>อุปกรณ์คงค้าง</span>
          <strong>{assets.length}</strong>
        </div>
        <div>
          <span>เกินกำหนดคืน</span>
          <strong className={overdueCount > 0 ? "text-danger" : ""}>{overdueCount}</strong>
        </div>
        <div>
          <span>กำหนดสิ้นสุด</span>
          <strong>{project.expected_end_date ? formatDate(project.expected_end_date) : "ไม่กำหนด"}</strong>
        </div>
      </section>

      <section className="card project-assets-card">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">ASSIGNED ASSETS</span>
            <h2 className="panel-title">อุปกรณ์ที่ยังอยู่กับโครงการ</h2>
          </div>
          <div className="project-selection-actions">
            <span>เลือก {selectedIds.length}</span>
            <button
              type="button"
              className="button button-primary"
              disabled={returnableSelected.length === 0}
              onClick={openSelectedReturn}
            >
              รับคืนที่เลือก {returnableSelected.length > 0 ? `(${returnableSelected.length})` : ""}
            </button>
          </div>
        </div>

        {assets.length === 0 ? (
          <div className="compact-empty">ไม่มีอุปกรณ์คงค้างในโครงการนี้</div>
        ) : (
          <div className="project-asset-list">
            {assets.map((item) => (
              <label key={item.id} className="project-asset-row">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(Number(item.id))}
                  onChange={() => toggleAsset(Number(item.id))}
                />
                <div>
                  <Link to={`/inventory/${item.id}`} className="serial-link" onClick={(event) => event.stopPropagation()}>
                    {item.serial_number}
                  </Link>
                  <span>{item.product_name} · {item.brand}</span>
                </div>
                <StatusBadge status={item.current_status} />
                <span>{item.current_location || "ไม่ระบุตำแหน่ง"}</span>
                <span>{item.expected_return_date ? `คืน ${formatDate(item.expected_return_date)}` : "ไม่กำหนดคืน"}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="card project-operation-history">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">HISTORY</span>
            <h2 className="panel-title">รายการล่าสุดของโครงการ</h2>
          </div>
          <Link to={`/operations?projectId=${project.id}`} className="text-link">ดูทั้งหมด</Link>
        </div>

        {operations.length === 0 ? (
          <div className="compact-empty">ยังไม่มีประวัติแบบหลายอุปกรณ์</div>
        ) : (
          <div className="operation-history-list">
            {operations.map((operation) => (
              <Link key={operation.id} to={`/operations/${operation.id}`} className="operation-history-row">
                <div className="operation-history-code">
                  <strong className="serial-text">{operation.operation_code}</strong>
                  <span>{formatDateTime(operation.created_at)}</span>
                </div>
                <div className="operation-history-main">
                  <strong>{OPERATION_CONFIG[operation.operation_type]?.label || operation.operation_type}</strong>
                  <span>{operation.destination_location}</span>
                </div>
                <div className="operation-history-meta">
                  <strong>{operation.item_count} รายการ</strong>
                </div>
                <span>→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default ProjectDetailPage;
