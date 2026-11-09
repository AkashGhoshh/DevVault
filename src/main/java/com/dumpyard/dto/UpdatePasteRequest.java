package com.dumpyard.dto;

import jakarta.validation.constraints.NotNull;

public record UpdatePasteRequest(
        String title,
        @NotNull(message = "Content cannot be null") String content,
        String tags,
        Boolean isPinned,
        String folder
) {
    public UpdatePasteRequest(String content) {
        this("", content, "", false, "General");
    }

    public UpdatePasteRequest(String title, String content) {
        this(title, content, "", false, "General");
    }

    public UpdatePasteRequest(String title, String content, String tags, Boolean isPinned) {
        this(title, content, tags, isPinned, "General");
    }
}
