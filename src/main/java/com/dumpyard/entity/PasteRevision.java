package com.dumpyard.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
public class PasteRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "paste_id", nullable = false)
    private Paste paste;

    @Column(columnDefinition = "TEXT")
    private String proposedContent;

    @Enumerated(EnumType.STRING)
    private RevisionStatus status;

    private LocalDateTime submittedAt;

    public enum RevisionStatus {
        PENDING, APPROVED, REJECTED
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Paste getPaste() { return paste; }
    public void setPaste(Paste paste) { this.paste = paste; }

    public String getProposedContent() { return proposedContent; }
    public void setProposedContent(String proposedContent) { this.proposedContent = proposedContent; }

    public RevisionStatus getStatus() { return status; }
    public void setStatus(RevisionStatus status) { this.status = status; }

    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
}
