package com.dumpyard.service;

import com.dumpyard.dto.CreatePasteRequest;
import com.dumpyard.dto.PasteResponse;
import com.dumpyard.dto.UpdatePasteRequest;

import java.util.List;

public interface PasteService {
    PasteResponse createPaste(CreatePasteRequest request);
    PasteResponse getPaste(Long id);
    List<PasteResponse> getAllPastes();
    PasteResponse updatePaste(Long id, UpdatePasteRequest request);
    void deletePaste(Long id);
}
