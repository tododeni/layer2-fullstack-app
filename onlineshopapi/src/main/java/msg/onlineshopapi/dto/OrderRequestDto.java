package msg.onlineshopapi.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderRequestDto {

    @NotNull(message = "Items cannot be null")
    private List<OrderItemRequestDto> items;

    @Valid
    @NotNull(message = "Address cannot be null")
    private AddressDto address;
}
