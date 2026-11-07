package com.dumpyard.dto;

import java.time.LocalDateTime;

public record PasteResponse(
        Long id,
        String title,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
