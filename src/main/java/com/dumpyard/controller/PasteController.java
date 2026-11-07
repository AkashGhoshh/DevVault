package com.dumpyard.controller;

import com.dumpyard.dto.CreatePasteRequest;
import com.dumpyard.dto.PasteResponse;
import com.dumpyard.dto.UpdatePasteRequest;
import com.dumpyard.service.PasteService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/pastes")
public class PasteController {

    private final PasteService pasteService;

    public PasteController(PasteService pasteService) {
        this.pasteService = pasteService;
    }

    @PostMapping
    public ResponseEntity<PasteResponse> createPaste(@Valid @RequestBody(required = false) CreatePasteRequest request) {
        CreatePasteRequest safeRequest = request != null ? request : new CreatePasteRequest("", "");
        PasteResponse response = pasteService.createPaste(safeRequest);
        return ResponseEntity.created(URI.create("/api/pastes/" + response.id())).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PasteResponse> getPaste(@PathVariable Long id) {
        return ResponseEntity.ok(pasteService.getPaste(id));
    }

    @GetMapping
    public ResponseEntity<List<PasteResponse>> getAllPastes() {
        return ResponseEntity.ok(pasteService.getAllPastes());
    }

    @PutMapping("/{id}")
    public ResponseEntity<PasteResponse> updatePaste(@PathVariable Long id, @Valid @RequestBody UpdatePasteRequest request) {
        return ResponseEntity.ok(pasteService.updatePaste(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePaste(@PathVariable Long id) {
        pasteService.deletePaste(id);
        return ResponseEntity.noContent().build();
    }
}
