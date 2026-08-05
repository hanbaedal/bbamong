export const getNoticeTagClass = (tag: string) => {
  switch (tag) {
    case "긴급":
      return "lscape-tag lscape-tag--urgent";
    case "우선":
      return "lscape-tag lscape-tag--priority";
    case "보통":
      return "lscape-tag lscape-tag--normal";
    default:
      return "lscape-tag lscape-tag--muted";
  }
};

export const getInquiryStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "대기";
    case "in_progress":
      return "진행";
    case "resolved":
      return "완료";
    default:
      return "대기";
  }
};

export const getInquiryStatusClass = (status: string) => {
  switch (status) {
    case "resolved":
      return "lscape-status lscape-status--done";
    case "in_progress":
      return "lscape-status lscape-status--progress";
    default:
      return "lscape-status lscape-status--pending";
  }
};
