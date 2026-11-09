package com.dumpyard.dto;

import java.time.LocalDateTime;

public record PasteResponse(
        Long id,
        String title,
        String content,
        String tags,
        Boolean isPinned,
        String folder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public PasteResponse(Long id, String title, String content, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, title, content, "", false, "General", createdAt, updatedAt);
    }

    public PasteResponse(Long id, String title, String content, String tags, Boolean isPinned, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, title, content, tags, isPinned, "General", createdAt, updatedAt);
    }
}
